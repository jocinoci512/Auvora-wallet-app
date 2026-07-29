import { Suspense, type ReactElement } from 'react';
import { NftGalleryExperience } from '../../components/nft/NftGalleryExperience';
import '../nft-experience.css';

export default function NftsPage(): ReactElement {
  return (
    <Suspense
      fallback={
        <div className="nx" aria-busy="true" aria-label="Loading gallery">
          <div className="nx-skeleton" />
        </div>
      }
    >
      <NftGalleryExperience />
    </Suspense>
  );
}
