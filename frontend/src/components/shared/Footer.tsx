import { DollarSign } from 'lucide-react'

const Footer = () => {
  return (

      <footer className="border-t border-slate-200 bg-slate-50 mt-auto">
          <div className="container mx-auto px-4 py-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm text-slate-600">© 2024 DonationTracker. All rights reserved.</span>
                  </div>
                  <div className="flex gap-6 text-sm text-slate-600">
                      <a href="#" className="hover:text-blue-600 transition-colors">Documentation</a>
                      <a href="#" className="hover:text-blue-600 transition-colors">Support</a>
                      <a href="#" className="hover:text-blue-600 transition-colors">GitHub</a>
                  </div>
              </div>
          </div>
      </footer>
  )
}

export default Footer