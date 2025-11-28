import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"

const NotConnected = () => {
  return (
    <Alert className="bg-orange-100 border-orange-600 text-foreground">
        <AlertCircleIcon className="text-orange-600" />
        <AlertTitle className="text-orange-900">Wallet Not Connected</AlertTitle>
        <AlertDescription className="text-orange-900">
            Please connect your Web3 wallet (e.g., MetaMask) to interact with the smart contract.
            Click the "Connect Wallet" button in the header to get started.
        </AlertDescription>
    </Alert>
  )
}

export default NotConnected