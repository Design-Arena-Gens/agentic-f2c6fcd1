import './globals.css';

export const metadata = {
  title: 'Web FPS Arena',
  description: 'A lightweight 3D FPS arena shooter in the browser',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
