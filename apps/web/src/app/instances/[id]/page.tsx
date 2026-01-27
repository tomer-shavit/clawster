import Link from 'next/link';
import { notFound } from 'next/navigation';

async function getInstance(id: string) {
  const res = await fetch(`${process.env.API_URL || 'http://localhost:4000'}/instances/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function InstanceDetail({ params }: { params: { id: string } }) {
  const instance = await getInstance(params.id);
  
  if (!instance) {
    notFound();
  }

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
          ← Back to instances
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{instance.name}</h1>
            <p className="text-gray-600 mt-1">
              {instance.environment} • Created {new Date(instance.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2">
            <form action={`/api/instances/${instance.id}/actions/restart`} method="POST">
              <button 
                type="submit"
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
              >
                Restart
              </button>
            </form>
            <form action={`/api/instances/${instance.id}/actions/stop`} method="POST">
              <button 
                type="submit"
                className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700"
              >
                Stop
              </button>
            </form>
            <form action={`/api/instances/${instance.id}?_method=DELETE`} method="POST">
              <button 
                type="submit"
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                onClick={(e) => {
                  if (!confirm('Are you sure you want to delete this instance?')) {
                    e.preventDefault();
                  }
                }}
              >
                Delete
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Overview</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-600">Status</dt>
                <dd className="font-medium">{instance.status}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Environment</dt>
                <dd className="font-medium capitalize">{instance.environment}</dd>
              </div>
              {instance.ecsServiceArn && (
                <div className="col-span-2">
                  <dt className="text-sm text-gray-600">ECS Service</dt>
                  <dd className="font-mono text-sm break-all">{instance.ecsServiceArn}</dd>
                </div>
              )}
              {instance.cloudwatchLogGroup && (
                <div className="col-span-2">
                  <dt className="text-sm text-gray-600">Logs</dt>
                  <dd>
                    <a 
                      href={`https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups/log-group/${encodeURIComponent(instance.cloudwatchLogGroup)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      View in CloudWatch →
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Configuration</h2>
            <p className="text-gray-600 text-sm mb-4">
              <Link href={`/instances/${instance.id}/edit`} className="text-blue-600 hover:underline">
                Edit configuration
              </Link>
            </p>
            {instance.manifests && instance.manifests.length > 0 ? (
              <div className="space-y-4">
                {instance.manifests.slice(0, 3).map((manifest: any) => (
                  <div key={manifest.id} className="border rounded p-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Version {manifest.version}</span>
                      <span className="text-gray-600">
                        {new Date(manifest.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
                      {JSON.stringify(manifest.content.metadata, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No manifests yet.</p>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href={`/instances/${instance.id}/edit`}
                className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Edit Manifest
              </Link>
              <form action={`/api/instances/${instance.id}/manifests/reconcile`} method="POST">
                <button 
                  type="submit"
                  className="w-full bg-gray-100 text-gray-800 px-4 py-2 rounded hover:bg-gray-200"
                >
                  Trigger Reconcile
                </button>
              </form>
            </div>
          </section>

          {instance.lastError && (
            <section className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-red-800 mb-2">Last Error</h2>
              <p className="text-red-700 text-sm">{instance.lastError}</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}