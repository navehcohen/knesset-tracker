import { getPhoto, getParty, type Member } from "../data/knesset";

// ראשי תיבות לשם (כשאין תמונה)
function initials(name: string): string {
  const parts = name.replace(/['"]/g, "").split(" ");
  return parts.slice(0, 2).map((p) => p[0]).join("");
}

// אווטאר ח"כ אחיד: תמונה אם יש, אחרת עיגול בצבע המפלגה עם ראשי תיבות.
// ח"כ שפרש מוצג באפור. אפשר לקבוע גודל בפיקסלים (size) או דרך className (למשל גודל רספונסיבי).
export default function MemberAvatar({
  member,
  size,
  className = "",
  textClassName = "",
}: {
  member: Pick<Member, "id" | "name" | "status" | "partyId">;
  size?: number;
  className?: string;
  textClassName?: string;
}) {
  const isFormer = member.status === "former";
  const photo = getPhoto(member.id);
  const party = getParty(member.partyId);
  const sizeStyle = size ? { width: size, height: size } : undefined;

  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photo}
        alt={member.name}
        className={`shrink-0 rounded-full object-cover ${isFormer ? "grayscale" : ""} ${className}`}
        style={sizeStyle}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${textClassName} ${className}`}
      style={{
        ...sizeStyle,
        fontSize: size ? size / 3 : undefined,
        backgroundColor: isFormer ? "#9ca3af" : party?.color ?? "#6b7280",
      }}
    >
      {initials(member.name)}
    </div>
  );
}
