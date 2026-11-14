import type { User } from "@/lib/api";

// Lilac ring from the design; shows the uploaded photo, or the first letter of the name.
export function Avatar({ user, size = "large" }: { user: Pick<User, "display_name" | "avatar_url">; size?: "large" | "small" }) {
  const box = size === "large"
    ? "size-20 border-[6px] text-[32px] md:size-28 md:border-8 md:text-[44px]"
    : "size-20 border-[6px] text-[32px]";
  return (
    <div className={`grid flex-none place-items-center overflow-hidden rounded-full border-accent font-extrabold text-accent ${box}`}>
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{user.display_name.trim().charAt(0).toUpperCase() || "?"}</span>
      )}
    </div>
  );
}
