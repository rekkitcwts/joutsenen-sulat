import Head from 'next/head';
import HeroSection from '@/components/HeroSection';
import { useEffect } from 'react';

export default function Home() {
  //const [darkMode, setDarkMode] = useState(false);
  
  return (
    <div>
      <Head>
        <title>Swan Feathers Cable</title>
        {/* Your existing head content */}
      </Head>
      
      <header>
        {/* Navigation with theme toggle */}
      </header>
      
      <main>
        <HeroSection />
      </main>
      
      <footer>
        {/* Contact info etc */}
      </footer>
    </div>
  )
}
