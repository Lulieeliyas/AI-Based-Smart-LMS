
import { useState } from "react";
import ResourceViewer from "../../components/digital/ResourceViewer";

export default function DigitalResourceCard({ resource }) {
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <>
      <article>
        <h3>{resource.title}</h3>
        <p>{resource.description}</p>

        <button
          type="button"
          onClick={() => setViewerOpen(true)}
        >
          View resource
        </button>
      </article>

      <ResourceViewer
        resource={resource}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </>
  );
}
