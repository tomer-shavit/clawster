export const metadata = {
  title: 'Molthub - Moltbot Control Plane',
  description: 'Self-hosted control plane for Moltbot instances',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}