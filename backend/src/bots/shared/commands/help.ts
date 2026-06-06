import { CommandResult } from '../types';

export function getHelpText(): CommandResult {
  return {
    text: `Smart AI Explorer Commands

/help - Show commands
/status - Bot status
/track <wallet> - Track wallet
/untrack <wallet> - Stop tracking wallet
/list - List tracked wallets`,
  };
}
