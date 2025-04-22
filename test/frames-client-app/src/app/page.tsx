'use client';

import React, { useEffect, useRef } from 'react';
import { IFrameWindow } from '@crossmint/client-sdk-window';

export default function Home() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeUrl = 'http://localhost:3030';

  useEffect(() => {
    const initIFrameWindow = async () => {
      if (iframeRef.current) {
        try {
          const frameWindow = IFrameWindow.initExistingIFrame(iframeRef.current, {
            targetOrigin: new URL(iframeUrl).origin,
          });

          // Establish connection with the iframe content
          await frameWindow.handshakeWithChild();
          console.log('Connected to iframe');

          // Set up event listener for messages from the iframe
          frameWindow.on('message', message => {
            console.log('Received message:', message);
          });

          // Clean up
          return () => {
            frameWindow.off('message');
          };
        } catch (error) {
          console.error('Failed to initialize or connect to iframe:', error);
        }
      }
    };

    initIFrameWindow();
  }, []);

  return (
    <main className="flex min-h-screen flex-col p-6 bg-gray-50">
      <h1 className="text-3xl font-bold mb-8 text-center">Frames Testing App</h1>
      <div className="w-full h-[600px] bg-white p-6 rounded-lg shadow-md">
        <iframe
          ref={iframeRef}
          src={iframeUrl}
          style={{ border: 'none', width: '100%', height: '100%' }}
          title="Frames Client"
        />
      </div>
    </main>
  );
}
