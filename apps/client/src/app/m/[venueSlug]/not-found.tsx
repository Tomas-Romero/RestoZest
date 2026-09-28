export default function VenueNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-xl font-semibold">No encontramos este local</h1>
      <p className="text-muted-foreground">Revisá el link o pedile al local que te pase el QR de nuevo.</p>
    </main>
  );
}
