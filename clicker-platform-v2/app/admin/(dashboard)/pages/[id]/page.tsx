import { redirect } from 'next/navigation';

export default async function PageEditorRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    if (id === 'create') {
        redirect('/admin/pages');
    }

    redirect(`/admin/pages?pageId=${id}`);
}
