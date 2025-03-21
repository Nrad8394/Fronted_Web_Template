"use client";
import Head from 'next/head';
import { useTheme } from '@/contexts/theme-context'; // Import the custom hook

const LandingPage = () => {
  const { theme, toggleTheme } = useTheme(); // Get the current theme and toggle function

  return (
    <div>
      <Head>
        <title>Welcome to Our Service</title>
        <meta name="description" content="Your go-to solution for great service." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className="p-2 bg-gray-800 text-white rounded-full dark:bg-white dark:text-gray-800 fixed top-4 right-4 z-10"
      >
        {theme === 'light' ? '🌙 Dark Mode' : '🌞 Light Mode'}
      </button>

      {/* Hero Section */}
      <section className=" card bg-blue-600 text-white h-screen flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-5xl font-bold mb-4">Welcome to Our Service</h1>
        <p className="text-xl mb-8 max-w-3xl mx-auto">
          Discover the best way to streamline your processes and get the most out of your service. Join us now and get started.
        </p>
        <a href="#cta" className="bg-white text-blue-600 py-2 px-6 rounded-lg text-lg font-semibold">
          Get Started
        </a>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-100 dark:bg-gray-800">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-semibold mb-8">Why Choose Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="p-6 bg-white shadow-lg rounded-lg dark:bg-gray-700">
              <h3 className="text-2xl font-semibold mb-4">Feature One</h3>
              <p className="text-lg text-gray-700 dark:text-gray-300">Get everything you need in one place, and save time.</p>
            </div>
            <div className="p-6 bg-white shadow-lg rounded-lg dark:bg-gray-700">
              <h3 className="text-2xl font-semibold mb-4">Feature Two</h3>
              <p className="text-lg text-gray-700 dark:text-gray-300">Highly efficient and scalable solutions for all your needs.</p>
            </div>
            <div className="p-6 bg-white shadow-lg rounded-lg dark:bg-gray-700">
              <h3 className="text-2xl font-semibold mb-4">Feature Three</h3>
              <p className="text-lg text-gray-700 dark:text-gray-300">Built to grow with your business, no matter the size.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section id="cta" className="bg-blue-600 text-white py-16 text-center">
        <h2 className="text-4xl font-semibold mb-4">Ready to Get Started?</h2>
        <p className="text-lg mb-8">Join thousands of satisfied users and take the first step today!</p>
        <a href="/signup" className="bg-white text-blue-600 py-2 px-6 rounded-lg text-lg font-semibold">
          Sign Up Now
        </a>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-6">
        <div className="container mx-auto text-center">
          <p>&copy; {new Date().getFullYear()} Your Company. All rights reserved.</p>
          <div className="mt-4">
            <a href="/terms" className="text-gray-400 hover:text-white mx-4">Terms of Service</a>
            <a href="/privacy" className="text-gray-400 hover:text-white mx-4">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
