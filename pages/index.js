export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="p-10 bg-white rounded shadow-md max-w-lg w-full">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-600">Willkommen zur S5Evo 5Kampf App</h1>
        <p className="text-gray-700 mb-4 text-center">
          Dies ist ein Beispiel-Startbildschirm mit Tailwind CSS Styling.
        </p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
          Los geht's
        </button>
      </div>
    </main>
  )
}
