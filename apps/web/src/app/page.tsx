import Link from 'next/link';
import { Instance, InstanceStatus } from '@molthub/core';

async function getInstances(): Promise<Instance[]> {
  const res = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/instances`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

function StatusBadge({ status }: { status: InstanceStatus }) {
  const colors: Record<InstanceStatus, string> = {
    CREATING: 'bg-yellow-100 text-yellow-800',
    RUNNING: 'bg-green-100 text-green-800',
    DEGRADED: 'bg-orange-100 text-orange-800',
    STOPPED: 'bg-gray-100 text-gray-800',
    DELETING: 'bg-red-100 text-red-800',
    ERROR: 'bg-red-200 text-red-900',
  };

  return (
    <span className={`px-2 py-1 rounded text-sm font-medium ${colors[status]}`}>
      {status}
    </span>
  );
}

export default async function Home() {
  const instances = await getInstances();

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Molthub</h1>
          <p className="text-gray-600">Control plane for Moltbot instances</p>
        </div>
        <Link
          href="/instances/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create Instance
        </Link>
      </header>

      <section className="bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold p-4 border-b">Instances</h2>
        
        {instances.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No instances yet.</p>
            <Link href="/instances/new" className="text-blue-600 hover:underline mt-2 inline-block">
              Create your first instance
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Environment</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Last Reconcile</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {instances.map((instance: any) => (
                <tr key={instance.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link 
                      href={`/instances/${instance.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {instance.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{instance.environment}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={instance.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {instance.lastReconcileAt 
                      ? new Date(instance.lastReconcileAt).toLocaleString()
                      : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}