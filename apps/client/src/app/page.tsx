export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">Resto Zest</h1>
      <p className="text-muted-foreground">
        El menú digital de cada local vive en <code>/m/[venueSlug]</code> — este link es solo el placeholder raíz.
      </p>
    </main>
  );
}
