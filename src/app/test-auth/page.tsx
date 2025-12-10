import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function TestAuthPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl">
          <h1 className="text-2xl font-bold mb-4">❌ No Auth</h1>
          <p className="mb-4">
            Add <code className="bg-gray-100 px-2 py-1 rounded">?devAuth=test@example.com</code> to URL
          </p>
          <p className="text-sm text-gray-500">
            Bypass enabled: {process.env.NEXT_PUBLIC_ENABLE_AUTH_BYPASS || 'false'}
          </p>
          <div className="mt-6">
            <a
              href="/test-auth?devAuth=test@example.com"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Try with devAuth param
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl">
        <h1 className="text-2xl font-bold mb-4 text-green-600">✅ Auth Working!</h1>

        <div className="mb-6">
          <h2 className="font-semibold mb-2">User Details:</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
{JSON.stringify(
  {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    isAdmin: user.isAdmin,
  },
  null,
  2
)}
          </pre>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold">Test Links:</h2>
          <a
            href="/dashboard/tickets?devAuth=buyer@example.com"
            className="block text-blue-600 hover:underline"
          >
            → Test Tickets Dashboard (as buyer@example.com)
          </a>
          <a
            href="/dashboard/table/my-table?devAuth=owner@example.com"
            className="block text-blue-600 hover:underline"
          >
            → Test Table Dashboard (as owner@example.com)
          </a>
          <a
            href="/admin?devAuth=admin@example.com"
            className="block text-blue-600 hover:underline"
          >
            → Test Admin (as admin@example.com - with admin access)
          </a>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            💡 Change the email in the <code className="bg-gray-100 px-2 py-1 rounded">?devAuth=</code> parameter to test different users.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Emails containing "admin" will have admin access.
          </p>
        </div>
      </div>
    </div>
  );
}
