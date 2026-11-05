export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-orbit-bg border-t border-orbit-border px-6 py-2">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-orbit-text-secondary">
        <div className="mx-auto flex items-center gap-2">
          <p className="flex items-center gap-1.5">
            &copy; {currentYear}
            <img src="/orbit-icon.svg" alt="logo" className="h-3 w-auto object-contain inline-block dark:invert dark:brightness-[0.85]" />
            All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}