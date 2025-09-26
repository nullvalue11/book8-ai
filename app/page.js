export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">Book8 AI Dashboard</h1>
      <p className="mt-2 text-gray-600">
        If you can see this page, the Next.js App Router structure has been restored.
      </p>
      <div className="mt-6 space-y-2 text-sm text-gray-700">
        <p>Quick checks:</p>
        <ul className="list-disc ml-5">
          <li>API self-test: GET /api/search/_selftest should return JSON</li>
          <li>Catch-all API route installed at /api/[[...path]] (placeholder)</li>
        </ul>
      </div>
    </main>
  );
}