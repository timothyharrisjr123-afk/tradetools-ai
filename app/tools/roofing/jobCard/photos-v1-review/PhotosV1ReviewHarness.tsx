"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type {
  JobAttachmentListItem,
  JobAttachmentPendingItem,
} from "@/app/lib/jobAttachmentTypes";
import JobCardAttachmentsWorkspace from "@/app/tools/roofing/jobCard/JobCardAttachmentsWorkspace";
import JobCardSectionPanel from "@/app/tools/roofing/jobCard/JobCardSectionPanel";
import JobCardTabs from "@/app/tools/roofing/jobCard/JobCardTabs";
import type { JobCardTabId } from "@/app/tools/roofing/jobCard/jobCardTypes";

const PHOTO_A_SRC =
  "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80";
const PHOTO_B_SRC =
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80";
const PHOTO_C_SRC =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80";

const PHOTO_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const PHOTO_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
const PHOTO_C = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";
const FILE_A = "dddddddd-dddd-4ddd-8ddd-ddddddddddd4";

function photo(
  overrides: Partial<JobAttachmentListItem> = {}
): JobAttachmentListItem {
  return {
    id: PHOTO_A,
    jobId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    kind: "image",
    mimeType: "image/jpeg",
    byteSize: 482331,
    originalFilename: "roof-front.jpg",
    caption: null,
    captureSource: "camera",
    jobStageAtUpload: "intake",
    createdAt: "2026-08-28T15:12:00.000Z",
    createdBy: "user-1",
    listedInJobGallery: true,
    widthPx: 1200,
    heightPx: 900,
    previewUrl: PHOTO_A_SRC,
    ...overrides,
  };
}

const POPULATED: JobAttachmentListItem[] = [
  photo({ id: PHOTO_A, previewUrl: PHOTO_A_SRC, createdAt: "2026-08-28T16:00:00.000Z" }),
  photo({
    id: PHOTO_B,
    previewUrl: PHOTO_B_SRC,
    originalFilename: "flashing.jpg",
    createdAt: "2026-08-28T15:40:00.000Z",
    jobStageAtUpload: "production",
  }),
  photo({
    id: PHOTO_C,
    previewUrl: PHOTO_C_SRC,
    originalFilename: "complete.jpg",
    createdAt: "2026-08-28T15:10:00.000Z",
    caption: "North slope complete",
    jobStageAtUpload: "complete",
  }),
];

const PDF: JobAttachmentListItem = {
  id: FILE_A,
  jobId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  kind: "document",
  mimeType: "application/pdf",
  byteSize: 245760,
  originalFilename: "permit.pdf",
  caption: null,
  captureSource: "file",
  jobStageAtUpload: "approved",
  createdAt: "2026-08-27T11:00:00.000Z",
  createdBy: "user-1",
  listedInJobGallery: true,
  widthPx: null,
  heightPx: null,
  previewUrl: "https://example.invalid/permit.pdf",
};

type SceneId =
  | "empty"
  | "add-menu"
  | "add-menu-desktop"
  | "populated"
  | "uploading"
  | "failed"
  | "viewer"
  | "files"
  | "caption";

const SCENES: Record<
  SceneId,
  {
    attachments: JobAttachmentListItem[];
    pending?: JobAttachmentPendingItem[];
    cameraAvailable?: boolean;
    initialViewerId?: string | null;
  }
> = {
  empty: { attachments: [], cameraAvailable: false },
  "add-menu": { attachments: [], cameraAvailable: true },
  "add-menu-desktop": { attachments: [], cameraAvailable: false },
  populated: { attachments: POPULATED, cameraAvailable: false },
  uploading: {
    attachments: POPULATED.slice(1),
    pending: [
      {
        localId: "pending-1",
        filename: "progress.jpg",
        kind: "image",
        previewUrl: PHOTO_B_SRC,
        progress: 42,
        status: "uploading",
        error: null,
      },
    ],
    cameraAvailable: false,
  },
  failed: {
    attachments: POPULATED.slice(1),
    pending: [
      {
        localId: "pending-fail",
        filename: "progress.jpg",
        kind: "image",
        previewUrl: PHOTO_B_SRC,
        progress: 0,
        status: "failed",
        error: "Upload failed.",
      },
    ],
    cameraAvailable: false,
  },
  viewer: {
    attachments: POPULATED,
    cameraAvailable: false,
    initialViewerId: PHOTO_A,
  },
  files: {
    attachments: [...POPULATED.slice(0, 2), PDF],
    cameraAvailable: false,
  },
  caption: {
    attachments: POPULATED,
    cameraAvailable: false,
    initialViewerId: PHOTO_C,
  },
};

export default function PhotosV1ReviewHarness() {
  const search = useSearchParams();
  const show = (search.get("show") ?? "populated") as SceneId;
  const scene = SCENES[show] ?? SCENES.populated;
  const [tab] = useState<JobCardTabId>("attachments");
  const [menuNudge] = useState(show === "add-menu" || show === "add-menu-desktop");

  return (
    <div className="bg-white" data-photos-v1-review={show}>
      <JobCardTabs activeTab={tab} onTabChange={() => undefined} />
      <div className="p-5 sm:p-6">
        <JobCardSectionPanel
          tabId="attachments"
          activeTab={tab}
          title="Attachments"
        >
          <div data-photos-v1-open-menu={menuNudge ? "true" : undefined}>
            <JobCardAttachmentsWorkspace
              attachments={scene.attachments}
              pending={scene.pending}
              cameraAvailable={scene.cameraAvailable}
              initialViewerId={scene.initialViewerId}
              initialMenuOpen={show === "add-menu" || show === "add-menu-desktop"}
              currentUserId="user-1"
              onAddFiles={() => undefined}
              onRetry={() => undefined}
              onCancelPending={() => undefined}
              onCaption={() => undefined}
              onRemove={() => undefined}
            />
          </div>
        </JobCardSectionPanel>
      </div>
    </div>
  );
}
