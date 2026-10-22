"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import { SITE } from "@/lib/site";
import {
  confirmEmailAction,
  emailAuthAction,
  finishResetAction,
  lookupEmailAction,
  resendJoinCodeAction,
  startResetAction,
  type AuthState,
} from "@/app/(auth)/actions";
import { useT } from "@/i18n/client";
import PickOne from "@/components/PickOne";
import { GENDERS, GENDER_EMOJI } from "@/lib/gender";
import { fill, rich } from "@/i18n/format";

// The buttons under "welcome to packmates": one big tap to get in.
//
// Apple and Google appear once their keys are set (see src/lib/oauth.ts).
// Email always works, and opens up in place rather than on another page:
// the address first, then whatever that address needs, a password if we
// know you, a name and a new password if we don't. Joining ends with the
// code we email, which proves the address is yours.

type Step = "start" | "email" | "password" | "create" | "confirm" | "reset" | "no-reset";

function AppleMark() {
  return (
    <svg viewBox="0 0 17 20" width="17" height="20" aria-hidden="true" fill="currentColor">
      <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.9 3.2-.5 8 1.3 10.6.9 1.3 2 2.7 3.3 2.7 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.8 1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-3-4.4ZM11.5 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.3-.6 3-1.5Z" />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5Z" />
    </svg>
  );
}

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** Submits a form through useActionState by hand rather than through the
 * form's action prop. Same request, but React doesn't clear the form
 * afterwards, so a "password too short" doesn't also throw away the name
 * you'd just typed. */
function submitWith(dispatch: (data: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
}

export default function SignIn({
  providers,
  canEmail,
  startWithEmail = false,
  error: outsideError,
  next = "/",
}: {
  providers: { apple: boolean; google: boolean };
  // Whether this site can send email, which is what decides how a
  // forgotten password gets reset.
  canEmail: boolean;
  // Straight to the email box, for the /login page when email is the
  // only way in anyway: one fewer tap to get to the thing you came for.
  startWithEmail?: boolean;
  error?: string | null;
  next?: string;
}) {
  const anyProvider = providers.apple || providers.google;
  const t = useT();
  // With email the only way in, the box is right there: no "Continue with
  // email" button to tap first.
  const [step, setStep] = useState<Step>(anyProvider ? "start" : "email");
  // Jump the cursor into the box only once they've asked for it (or came
  // to the sign-in page for it): on the front page it would throw up the
  // keyboard over everything before anyone's read a word.
  const [focusEmail, setFocusEmail] = useState(startWithEmail);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState("");
  const [joinedWith, setJoinedWith] = useState<"apple" | "google" | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const [leaving, setLeaving] = useState<"apple" | "google" | null>(null);
  const [state, formAction, submitting] = useActionState<AuthState, FormData>(emailAuthAction, {
    error: null,
  });
  const [resetState, resetAction, resetting] = useActionState<AuthState, FormData>(
    finishResetAction,
    { error: null }
  );
  const [resetError, setResetError] = useState<string | null>(null);
  const [sendingReset, startSendingReset] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);
  // Kept from the form for the code screen, which sends it along with the
  // code (see confirmEmailAction for why).
  const [password, setPassword] = useState("");
  // A fresh code screen each time one's sent, with no errors left over
  // from the last.
  const [confirmKey, setConfirmKey] = useState(0);
  useEffect(() => {
    if (state.confirm) {
      setStep("confirm");
      setConfirmKey((k) => k + 1);
    }
  }, [state]);

  // The error from a provider bounce (?error=…) belongs to the first
  // screen; once you've moved on it's old news.
  const shownError =
    step === "start"
      ? outsideError
      : step === "email"
        ? lookupError
        : step === "reset"
          ? resetState.error
          : step === "no-reset" || step === "confirm"
            ? null
            : resetError ?? state.error;

  function forgot() {
    setResetError(null);
    if (!canEmail) {
      setStep("no-reset");
      return;
    }
    startSendingReset(async () => {
      const result = await startResetAction(email);
      if (result.ok) setStep("reset");
      else setResetError(result.error);
    });
  }

  function lookUp(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    startLookup(async () => {
      const result = await lookupEmailAction(email);
      if (result.kind === "invalid") {
        setLookupError(result.error);
        emailRef.current?.focus();
      } else if (result.kind === "new") {
        setTicket(result.ticket);
        setStep("create");
      } else {
        setJoinedWith(result.provider);
        setStep("password");
      }
    });
  }

  const errorBox = shownError ? (
    <p role="alert" className="rounded-2xl bg-white/95 px-4 py-2.5 text-sm font-medium text-red-700 shadow">
      {shownError}
    </p>
  ) : null;

  if (step === "start") {
    return (
      <div className="space-y-3">
        {errorBox}
        {providers.apple && (
          <a
            href="/auth/apple"
            onClick={() => setLeaving("apple")}
            className="pill-btn pill-black"
          >
            {leaving === "apple" ? <Spinner /> : <AppleMark />}
            {fill(t.signIn.continueWith, { provider: "Apple" })}
          </a>
        )}
        {providers.google && (
          <a
            href="/auth/google"
            onClick={() => setLeaving("google")}
            className="pill-btn pill-white"
          >
            {leaving === "google" ? <Spinner /> : <GoogleMark />}
            {fill(t.signIn.continueWith, { provider: "Google" })}
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            setFocusEmail(true);
            setStep("email");
          }}
          // With no providers set up, email is the one big button, in the
          // black the Apple button would have had.
          className={`pill-btn ${anyProvider ? "pill-ghost" : "pill-black"}`}
        >
          <span aria-hidden="true">✉️</span>
          {t.signIn.continueWithEmail}
        </button>
        {/* Apple and Google make the account without our sign up form, so
            the agreement is said here instead of ticked. */}
        {anyProvider && (
          <p className="text-center text-sm text-white">
            {rich(fill(t.signIn.byContinuing, { age: SITE.minimumAge }), {
              terms: (
                <a href="/terms" className="font-semibold underline">
                  {t.common.terms}
                </a>
              ),
              privacy: (
                <a href="/privacy" className="font-semibold underline">
                  {t.common.privacy}
                </a>
              ),
            })}
          </p>
        )}
      </div>
    );
  }

  const back = (
    <button
      type="button"
      onClick={() => {
        setStep(step === "email" ? "start" : step === "reset" || step === "no-reset" ? "password" : "email");
        setLookupError(null);
        setResetError(null);
      }}
      className="text-sm font-medium text-white underline underline-offset-2"
    >
      {step === "email" || step === "reset" || step === "no-reset" ? t.common.back : t.signIn.otherEmail}
    </button>
  );

  if (step === "no-reset") {
    return (
      <div className="space-y-3 text-center text-white">
        <p className="text-lg font-bold">{t.signIn.forgotIt} 🔑</p>
        <p className="rounded-2xl bg-white/15 px-4 py-3 text-base">{t.signIn.askAdmin}</p>
        <div className="pt-1">{back}</div>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <form onSubmit={submitWith(resetAction)} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <input type="email" value={email} autoComplete="username" readOnly hidden />
        <p className="text-center text-white">
          <span className="block text-lg font-bold">{t.signIn.checkEmail} 📬</span>
          <span className="text-sm text-white">
            {rich(t.signIn.sentCode, { email: <strong className="text-white">{email}</strong> })}
          </span>
        </p>
        {errorBox}
        <label htmlFor="reset-code" className="field-label">
          {t.signIn.code}
        </label>
        <input
          id="reset-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          className="pill-input text-center tracking-[0.3em]"
        />
        <label htmlFor="reset-password" className="field-label">
          {t.signIn.newPassword}
        </label>
        <div className="relative">
          <input
            id="reset-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            minLength={8}
            aria-describedby="reset-password-hint"
            className="pill-input !pr-24"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-pressed={showPassword}
            className="absolute right-2 top-1/2 h-11 -translate-y-1/2 rounded-full px-4 text-base font-semibold text-brand-700 hover:bg-brand-50"
          >
            {showPassword ? t.common.hide : t.common.show}
          </button>
        </div>
        <p id="reset-password-hint" className="field-hint">
          {t.signIn.passwordHint}
        </p>
        <button type="submit" disabled={resetting} className="pill-btn pill-black">
          {resetting && <Spinner />}
          {t.signIn.saveAndSignIn}
        </button>
        <div className="text-center pt-1">{back}</div>
      </form>
    );
  }

  if (step === "confirm") {
    return (
      <ConfirmCode
        key={confirmKey}
        email={email}
        password={password}
        next={next}
        firstError={state.error}
        back={back}
      />
    );
  }

  if (step === "email") {
    return (
      <form onSubmit={lookUp} className="space-y-3">
        {errorBox}
        <label htmlFor="signin-email" className="field-label">
          {t.signIn.yourEmail}
        </label>
        <input
          ref={emailRef}
          id="signin-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus={focusEmail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pill-input"
        />
        <button type="submit" disabled={looking} className="pill-btn pill-black">
          {looking && <Spinner />}
          {t.signIn.continue}
        </button>
        {anyProvider && <div className="text-center pt-1">{back}</div>}
      </form>
    );
  }

  const creating = step === "create";
  return (
    <form
      onSubmit={(e) => {
        setPassword(String(new FormData(e.currentTarget).get("password") ?? ""));
        submitWith(formAction)(e);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="mode" value={creating ? "signup" : "login"} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="next" value={next} />
      {creating && <input type="hidden" name="ticket" value={ticket} />}
      {/* Lets the browser's password manager file the new password under
          the right address. */}
      <input type="email" value={email} autoComplete="username" readOnly hidden />

      <p className="text-center text-white">
        {creating ? (
          <>
            <span className="block text-lg font-bold">{t.signIn.niceToMeet} 👋</span>
            <span className="text-sm text-white">
              <strong className="text-white">{email}</strong>
            </span>
          </>
        ) : (
          <>
            <span className="block text-lg font-bold">{t.signIn.welcomeBack} 🙌</span>
            <span className="text-sm text-white">
              <strong className="text-white">{email}</strong>
            </span>
          </>
        )}
      </p>

      {errorBox}

      {!creating && joinedWith && (
        <p className="rounded-2xl bg-white/15 px-4 py-2.5 text-sm text-white">
          {fill(t.signIn.joinedWith, { provider: joinedWith === "apple" ? "Apple" : "Google" })}{" "}
          <a href={`/auth/${joinedWith}`} className="font-semibold underline">
            {fill(t.signIn.continueWith, { provider: joinedWith === "apple" ? "Apple" : "Google" })}
          </a>
        </p>
      )}

      {creating && (
        <>
          {/* For bots only: off screen, out of the tab order, ignored by
              password managers. A person never fills it in. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute -left-[9999px] h-px w-px opacity-0"
          />
          <label htmlFor="signin-name" className="field-label">
            {t.signIn.firstName}
          </label>
          <input
            id="signin-name"
            name="name"
            autoComplete="given-name"
            required
            minLength={2}
            maxLength={80}
            autoFocus
            className="pill-input"
          />
          {/* Which meetups they see: mixed ones, and their own group's.
              Changed later on Me. */}
          <fieldset>
            <legend className="field-label mb-2">{t.gender.iAm}</legend>
            <PickOne
              name="gender"
              required
              options={GENDERS.map((g) => ({ value: g, emoji: GENDER_EMOJI[g], label: t.gender[g] }))}
            />
          </fieldset>
        </>
      )}
      <label htmlFor="signin-password" className="field-label">
        {creating ? t.signIn.choosePassword : t.signIn.yourPassword}
      </label>
      {/* Show lets people check what they typed on a phone keyboard,
          rather than finding out from "wrong password". */}
      <div className="relative">
        <input
          id="signin-password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={creating ? "new-password" : "current-password"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          minLength={creating ? 8 : 1}
          autoFocus={!creating}
          aria-describedby={creating ? "signin-password-hint" : undefined}
          className="pill-input !pr-24"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          aria-pressed={showPassword}
          className="absolute right-2 top-1/2 h-11 -translate-y-1/2 rounded-full px-4 text-base font-semibold text-brand-700 hover:bg-brand-50"
        >
          {showPassword ? t.common.hide : t.common.show}
        </button>
      </div>
      {creating && (
        <p id="signin-password-hint" className="field-hint">
          {t.signIn.passwordHint}
        </p>
      )}
      {creating && (
        <label className="flex items-start gap-3 rounded-2xl bg-white/15 px-4 py-3 text-sm text-white">
          <input type="checkbox" name="agree" required className="mt-0.5 h-6 w-6 flex-none accent-white" />
          <span>
            {rich(fill(t.signIn.agree, { age: SITE.minimumAge }), {
              terms: (
                <a href="/terms" target="_blank" rel="noopener" className="font-semibold underline">
                  {t.common.terms}
                </a>
              ),
              privacy: (
                <a href="/privacy" target="_blank" rel="noopener" className="font-semibold underline">
                  {t.common.privacy}
                </a>
              ),
            })}
            <span className="mt-1 block text-white/85">{fill(t.signIn.madeFor, { ages: SITE.recommendedAges })}</span>
          </span>
        </label>
      )}
      <button type="submit" disabled={submitting} className="pill-btn pill-black">
        {submitting && <Spinner />}
        {creating ? t.signIn.createAccount : t.signIn.signIn}
      </button>
      <div className="flex items-center justify-center gap-4 pt-1">
        {back}
        {!creating && (
          <button
            type="button"
            onClick={forgot}
            disabled={sendingReset}
            className="text-sm font-medium text-white underline underline-offset-2"
          >
            {sendingReset ? t.signIn.sending : t.signIn.forgotPassword}
          </button>
        )}
      </div>
    </form>
  );
}

/** Joining, last step: the code we emailed. Also where somebody lands
 * who joined, never typed it, and signs in later. */
function ConfirmCode({
  email,
  password,
  next,
  firstError,
  back,
}: {
  email: string;
  password: string;
  next: string;
  // Why the email might not have gone, from the step before.
  firstError: string | null;
  back: React.ReactNode;
}) {
  const t = useT();
  const [state, action, confirming] = useActionState<AuthState, FormData>(confirmEmailAction, {
    error: firstError,
  });
  // What "Send a new code" said, until the next try at the code.
  const [resent, setResent] = useState<AuthState | null>(null);
  const [resending, startResending] = useTransition();
  const error = resent ? resent.error : state.error;

  return (
    <form
      onSubmit={(e) => {
        setResent(null);
        submitWith(action)(e);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={password} />
      <input type="hidden" name="next" value={next} />
      <p className="text-center text-white">
        <span className="block text-lg font-bold">{t.signIn.checkEmail} 📬</span>
        <span className="text-sm text-white">
          {rich(t.signIn.sentCode, { email: <strong className="text-white">{email}</strong> })}
        </span>
      </p>
      {error && (
        <p role="alert" className="rounded-2xl bg-white/95 px-4 py-2.5 text-sm font-medium text-red-700 shadow">
          {error}
        </p>
      )}
      {resent && !resent.error && (
        <p role="status" className="rounded-2xl bg-white/15 px-4 py-2.5 text-center text-sm font-medium text-white">
          ✓ {t.signIn.newCodeSent}
        </p>
      )}
      <label htmlFor="confirm-code" className="field-label">
        {t.signIn.code}
      </label>
      <input
        id="confirm-code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        required
        autoFocus
        className="pill-input text-center tracking-[0.3em]"
      />
      <button type="submit" disabled={confirming} className="pill-btn pill-black">
        {confirming && <Spinner />}
        {t.signIn.continue}
      </button>
      <div className="flex items-center justify-center gap-4 pt-1">
        {back}
        <button
          type="button"
          disabled={resending}
          onClick={() => startResending(async () => setResent(await resendJoinCodeAction(email, password)))}
          className="text-sm font-medium text-white underline underline-offset-2"
        >
          {resending ? t.signIn.sending : t.signIn.newCode}
        </button>
      </div>
    </form>
  );
}
