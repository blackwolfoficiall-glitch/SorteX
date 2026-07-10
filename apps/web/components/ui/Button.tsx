type ButtonProps = {
  children: React.ReactNode;
  type?: "button" | "submit";
  onClick?: () => void;
  className?: string;
};

export default function Button({
  children,
  type = "button",
  onClick,
  className = "",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`w-full rounded-2xl bg-gradient-to-r from-violet-700 to-purple-600 py-4 font-bold text-white transition hover:scale-[1.02] ${className}`}
    >
      {children}
    </button>
  );
}