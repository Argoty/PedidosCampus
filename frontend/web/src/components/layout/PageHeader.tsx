export function PageHeader({ title, description, children }: { title: string, description?: string, children?: React.ReactNode }) {
    return (
        <div className="flex flex-col md:flex-row md:items-start md:justify-between items-start gap-4 mb-8">
            <div className="flex-1 space-y-1.5">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {description && <p className="text-muted-foreground">{description}</p>}
            </div>
            {children && <div>{children}</div>}
        </div>
    );
}
