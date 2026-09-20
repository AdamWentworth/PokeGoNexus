import { useEffect } from 'react';

const usePublicPageMetadata = (title: string, description: string) => {
  useEffect(() => {
    const previousTitle = document.title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = meta?.content;
    const createdMeta = !meta;

    document.title = title;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.append(meta);
    }
    meta.content = description;

    return () => {
      document.title = previousTitle;
      if (createdMeta) {
        meta?.remove();
      } else if (meta && previousDescription !== undefined) {
        meta.content = previousDescription;
      }
    };
  }, [description, title]);
};

export default usePublicPageMetadata;
