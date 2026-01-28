import { useEffect, type MutableRefObject } from 'react';
import type { Socket } from 'socket.io-client';

export function useLeaveRoomOnUnmount(socketRef: MutableRefObject<Socket | null>) {
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-room');
      }
    };
  }, []);
}
