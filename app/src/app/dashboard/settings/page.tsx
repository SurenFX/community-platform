import { redirect } from 'next/navigation'

// Redirigir a la página de configuración unificada
export default function SettingsPage() {
  redirect('/dashboard/configuracion')
}
