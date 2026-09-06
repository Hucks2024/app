export default function Avatar({
  userId,
  hasPhoto,
  size = 10,
}: {
  userId: string;
  hasPhoto: boolean;
  size?: number;
}) {
  const dim = `${size * 0.25}rem`; // tailwind-ish sizing without dynamic class names
  if (hasPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/photos/profile/${userId}`}
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
