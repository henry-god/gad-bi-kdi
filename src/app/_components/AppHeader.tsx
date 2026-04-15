import Link from 'next/link';
import RoleSwitcher from './RoleSwitcher';

export default function AppHeader() {
  return (
    <header className="bg-kgd-blue text-white">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between flex-wrap gap-3">
        <Link href="/">
          <h1 className="font-khmer-header text-lg">ប្រព័ន្ធឯកសារឆ្លាតវៃ</h1>
          <p className="text-[10px] opacity-80">Khmer Government Document Intelligence</p>
        </Link>
        <nav className="flex gap-4 text-sm items-center">
          <Link href="/" className="hover:underline font-khmer">ផ្ទាំងគ្រប់គ្រង</Link>
          <Link href="/documents" className="hover:underline font-khmer">ឯកសាររបស់ខ្ញុំ</Link>
          <Link href="/approvals" className="hover:underline font-khmer">បញ្ជីពិនិត្យ</Link>
          <Link href="/documents/new" className="hover:underline font-khmer">+ ថ្មី</Link>
          <Link href="/settings" className="hover:underline font-khmer">⚙ API</Link>
        </nav>
        <RoleSwitcher />
      </div>
    </header>
  );
}
