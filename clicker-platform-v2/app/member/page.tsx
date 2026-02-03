import { redirect } from 'next/navigation';

export default function MemberRootRedirect() {
    redirect('/member/login');
}
