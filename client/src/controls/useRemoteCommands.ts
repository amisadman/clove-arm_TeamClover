import { useEffect } from 'react';
import socket from '../socket/socket';
import { emit as emitCommand } from '../pipeline/commandBus';
import { runPin } from '../pipeline/pinSequencer';
import { setControllerCount } from './remoteStore';

export default function useRemoteCommands() {
  useEffect(() => {
    // Register as dashboard
    socket.emit('register', 'dashboard');

    // Handle commands
    const handleCommand = (cmd: any) => {
      if (cmd.type === 'ENTER_PIN') {
        runPin(cmd.pin);
      } else {
        emitCommand(cmd);
      }
    };

    // Handle status updates
    const handleStatus = (status: { dashboards: number; controllers: number }) => {
      setControllerCount(status.controllers);
    };

    socket.on('command', handleCommand);
    socket.on('status', handleStatus);

    return () => {
      socket.off('command', handleCommand);
      socket.off('status', handleStatus);
    };
  }, []);
}
