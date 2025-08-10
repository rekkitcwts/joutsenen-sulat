// frontend/components/HeroSection.js
export default function HeroSection() {
  return (
    <section className="hero min-h-[60vh] flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-800 text-white">
      <div className="text-center">
        <h1 className="text-5xl font-bold mb-6">Welcome to Swan Feathers Cable</h1>
        <p className="text-xl mb-8">Premium TV services for your home</p>
        <button className="bg-red-600 hover:bg-red-700 px-8 py-3 rounded-full text-lg font-semibold transition-all">
          View Channel Packages
        </button>
      </div>
    </section>
  );
}
