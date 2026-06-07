import { ConnectedWalletModel, IConnectedWallet } from '../models/ConnectedWallet';
import { isValidXdcAddress, detectNetwork, Network } from '../utils/network';
import { logger } from '../utils/logger';

export interface ConnectResult {
  success: boolean;
  message: string;
  wallet?: IConnectedWallet;
}

export async function connectWallet(
  userId: string,
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x',
  address: string,
  network?: Network
): Promise<ConnectResult> {
  const trimmed = address.trim();

  if (!isValidXdcAddress(trimmed)) {
    return { success: false, message: '❌ Invalid address. Please enter a valid XDC address.' };
  }

  // Use explicitly passed network, or detect from address prefix
  const detectedNetwork = network || detectNetwork(trimmed);
  logger.info('[ConnectedWalletService] Network selection', { passedNetwork: network, detectedNetwork, address: trimmed });

  try {
    // Upsert: disconnect old, connect new
    await ConnectedWalletModel.updateOne(
      { userId, platform },
      {
        userId,
        platform,
        address: trimmed,
        network: detectedNetwork,
        isConnected: true,
      }
    );

    const label = detectedNetwork === 'testnet' ? '🧪 Testnet' : '🌐 Mainnet';
    return {
      success: true,
      message: `✅ Wallet Connected\n\n${label}\n${trimmed}`,
    };
  } catch (err) {
    logger.error('[ConnectedWalletService] Connect failed', { userId, error: err });
    return { success: false, message: '❌ Failed to save wallet. Please try again.' };
  }
}

export async function disconnectWallet(
  userId: string,
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x'
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await ConnectedWalletModel.updateOne(
      { userId, platform },
      { isConnected: false }
    );

    if (!result) {
      return { success: false, message: '⚠️ No wallet found to disconnect.' };
    }

    return { success: true, message: '✅ Wallet Disconnected\n\nYour wallet has been removed.' };
  } catch (err) {
    logger.error('[ConnectedWalletService] Disconnect failed', { userId, error: err });
    return { success: false, message: '❌ Failed to disconnect wallet.' };
  }
}

export async function getConnectedWallet(
  userId: string,
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x'
): Promise<IConnectedWallet | null> {
  return ConnectedWalletModel.findByUserId(userId, platform);
}

export async function hasConnectedWallet(
  userId: string,
  platform: 'telegram' | 'whatsapp' | 'slack' | 'x'
): Promise<boolean> {
  const count = await ConnectedWalletModel.countDocuments({ userId, platform, isConnected: true });
  return count > 0;
}
