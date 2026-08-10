import Modal from "@/components/ui/Modal";
import UploadForm from "@/components/UploadForm";
import type { Video } from "@/api/types";

interface UploadModalProps {
  onClose: () => void;
  onUploaded: (video: Video) => void;
}

export default function UploadModal({ onClose, onUploaded }: UploadModalProps) {
  return (
    <Modal title="Upload video" onClose={onClose}>
      <UploadForm
        onUploaded={(video) => {
          onUploaded(video);
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
