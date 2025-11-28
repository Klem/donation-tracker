import { ConnectButton } from '@rainbow-me/rainbowkit';
import { DollarSign } from 'lucide-react'

const Header = () => {
  return (
      <header className="border-b border-slate-200 bg-white">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-xl font-bold text-slate-900">DonationTracker</h1>
              </div>
              <ConnectButton />
          </div>
      </header>
  )
}

export default Header