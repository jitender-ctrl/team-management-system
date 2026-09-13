import { fileUrl } from "../utils/files";

export default function Avatar({ url, name, size = "md" }) {
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const sizeClass = size === "lg" ? "w-20 h-20 text-lg" : size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";

  if (url) {
    return <img src={fileUrl(url)} alt={name} className={`${sizeClass} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${sizeClass} rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold shrink-0`}>
      {initials}
    </div>
  );
}
