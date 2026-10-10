export default function Avatar({
  userId,
  hasPhoto,
  version,
  size = 10,
}: {
  userId: string;
  hasPhoto: boolean;
  // When the photo last changed (photoUpdatedAt). In the link, so phones
  // can keep the photo until it changes (see the photo route).
  version?: Date | null;
  size?: number;
}) {
  const dim = `${size * 0.25}rem`; // tailwind-ish sizing without dynamic class names
  if (hasPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/photos/profile/${userId}${version ? `?v=${version.getTime()}` : ""}`}
        alt=""
        className="rounded-full object-cover bg-slate-200"
        style={{ width: dim, height: dim }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-slate-200 flex items-center justify-center"
      style={{ width: dim, height: dim }}
    >
      🏃
    </div>
  );
}
