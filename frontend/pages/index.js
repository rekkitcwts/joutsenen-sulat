import Head from 'next/head';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    // Confetti effect
    import('canvas-confetti').then(confetti => {
      setTimeout(() => {
        confetti.default({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          disableForReducedMotion: true
        });
      }, 500);
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Head>
        <title>TV Guide Service</title>
        <link rel="stylesheet" href="https://p.typekit.net/p.css?s=1&k=vnd5zic&ht=tk&f=39475.39476.39477.39478.39479.39480.39481.39482&a=18673890&app=typekit&e=css" />
      </Head>
      
      <main className="text-center">
        <section className="rounded-xl p-4 transform -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2">
          <h1 className="font-neo-sans font-bold text-6xl">Tervetuloa!</h1>
          <div className="mt-8">
            <a 
              href="/epg.xml" 
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-medium transition-colors"
            >
              View EPG
            </a>
          </div>
        </section>
      </main>

      <style jsx global>{`
        html {
          font-family: neo-sans;
          font-weight: 700;
        }
        @font-face {
          font-family: "neo-sans";
          src: url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/l?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff2"),
               url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/d?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("woff"),
               url("https://use.typekit.net/af/00ac0a/00000000000000003b9b2033/27/a?primer=7cdcb44be4a7db8877ffa5c0007b8dd865b3bbc383831fe2ea177f62257a9191&fvd=n7&v=3") format("opentype");
          font-style: normal;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
