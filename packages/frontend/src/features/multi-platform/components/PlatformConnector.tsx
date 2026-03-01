import React from 'react';
import {
  usePlatformStatus,
  useConnectPlatform,
  useDisconnectPlatform,
} from '../hooks/usePlatformConnections';
import { PLATFORM_DISPLAY } from '../types';

const PlatformConnector: React.FC = () => {
  const { data: statuses, isLoading } = usePlatformStatus();
  const connectMutation = useConnectPlatform();
  const disconnectMutation = useDisconnectPlatform();

  const handleConnect = async (platform: string) => {
    const result = await connectMutation.mutateAsync(platform);
    if (result.data?.authorization_url) {
      window.location.href = result.data.authorization_url;
    }
  };

  const handleDisconnect = (platform: string) => {
    disconnectMutation.mutate(platform);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-40 rounded bg-gray-200" />
          <div className="h-12 rounded bg-gray-100" />
          <div className="h-12 rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900">Platform Connections</h3>
      <p className="mt-1 text-sm text-gray-500">
        Connect your social media accounts to publish and manage content across platforms.
      </p>

      <div className="mt-4 space-y-3">
        {(statuses || []).map((status) => {
          const display = PLATFORM_DISPLAY[status.platform] || {
            name: status.platform,
            color: '#6B7280',
          };

          return (
            <div
              key={status.platform}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: display.color }} />
                <div>
                  <p className="font-medium text-gray-900">{display.name}</p>
                  {status.connected && status.username && (
                    <p className="text-sm text-gray-500">{status.username}</p>
                  )}
                </div>
              </div>

              {status.connected ? (
                <button
                  className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  onClick={() => handleDisconnect(status.platform)}
                  disabled={disconnectMutation.isPending}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700"
                  onClick={() => handleConnect(status.platform)}
                  disabled={connectMutation.isPending}
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PlatformConnector;
