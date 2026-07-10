interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export default function PageHeader({
  title,
  subtitle,
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-4xl font-bold text-zinc-900">
        {title}
      </h1>

      <p className="mt-2 text-zinc-500">
        {subtitle}
      </p>
    </div>
  );
}