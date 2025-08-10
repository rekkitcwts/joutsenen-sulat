import Head from 'next/head';
import { useEffect } from 'react';

export default function Home() {
  //const [darkMode, setDarkMode] = useState(false);
  
  return (
    <div>
      <Head>
        <title>Beispiel Cable Services</title>
        {/* Your existing head content */}
      </Head>
      
      <header>
        {/* Navigation with theme toggle */}
      </header>
      
      <main>
        /*<HeroSection />
        <ChannelShowcase />
        <EPGPreview />
        <ServiceAreas />*/
      </main>
      
      <footer>
        {/* Contact info etc */}
      </footer>
    </div>
  )
}
