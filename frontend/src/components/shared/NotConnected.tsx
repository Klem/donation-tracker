import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircleIcon } from "lucide-react"

const NotConnected = () => {
  return (
    <Alert className="bg-orange-100 border-orange-600 text-foreground">
        <AlertCircleIcon className="text-orange-600" />
        <AlertTitle className="text-orange-900">Portefeuille non connecté</AlertTitle>
        <AlertDescription className="text-orange-900">
            Veuillez connecter votre portefeuille Web3 (ex: MetaMask) pour interagir avec le contrat intelligent.
            Cliquez sur le bouton "Connecter le portefeuille" dans l'en-tête pour commencer.
        </AlertDescription>
    </Alert>
  )
}

export default NotConnected