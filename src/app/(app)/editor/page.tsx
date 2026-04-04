import { redirect } from 'next/navigation';

/** Ancienne route ; le tableau des inventions et l’admin unifié sont sur `/admin`. */
export default function EditorPageRedirect() {
  redirect('/admin');
}
