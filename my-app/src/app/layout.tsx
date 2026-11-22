import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/navbar";
import Footer from "./components/footer";

export const metadata: Metadata = {
  title: "AssistIQ | Street-Smart Academic AI",
  description: "AssistIQ — Academic intelligence with electric street graffiti art style. Master emails, documents, and quizzes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bungee+Inline&family=Permanent+Marker&family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Rubik+Spray+Paint&family=Sedgwick+Ave+Display&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-[#070a12] text-[#f1f5f9] font-body selection:bg-[#0ea5e9] selection:text-[#070a12]">
        <Navbar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
