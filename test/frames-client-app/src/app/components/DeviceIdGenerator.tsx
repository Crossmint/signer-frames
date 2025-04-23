'use client';

import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface DeviceIdGeneratorProps {
  onDeviceIdGenerated?: (deviceId: string) => void;
}

export default function DeviceIdGenerator({ onDeviceIdGenerated }: DeviceIdGeneratorProps) {
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  // Load device ID from localStorage on component mount
  useEffect(() => {
    const storedDeviceId = localStorage.getItem('deviceId');
    if (storedDeviceId) {
      setCurrentDeviceId(storedDeviceId);
    }
  }, []);

  const generateNewDeviceId = () => {
    const newDeviceId = uuidv4();
    localStorage.setItem('deviceId', newDeviceId);
    setCurrentDeviceId(newDeviceId);

    if (onDeviceIdGenerated) {
      onDeviceIdGenerated(newDeviceId);
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-lg font-medium text-gray-900 mb-2">Device ID</h2>

      <div className="mb-4">
        {currentDeviceId ? (
          <div className="flex items-center">
            <span className="text-sm font-mono bg-gray-100 p-2 rounded mr-2 overflow-x-auto max-w-full">
              {currentDeviceId}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-600">No device ID generated yet</p>
        )}
      </div>

      <button
        type="button"
        onClick={generateNewDeviceId}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        {currentDeviceId ? 'Generate New Device ID' : 'Generate Device ID'}
      </button>
    </div>
  );
}
