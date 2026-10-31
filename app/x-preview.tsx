// A post as it will look in the X feed (dark theme): who, the text with its line breaks,
// the image, and the action row. Read-only; it is there so nothing about the post is a
// surprise once it is out.
import { Avatar } from "./avatar.tsx";

const ICON = {
  reply: "M8 10h8M8 14h5M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z",
  repost: "M7 7h11l-3-3M17 17H6l3 3M18 7v5M6 17v-5",
  like: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  views: "M5 20V10M10 20V4M15 20v-7M20 20v-4",
};

export function XPreview({ name, handle, brand, text, image, note }: { name: string; handle: string; brand: boolean; text: string; image?: string | null; note?: string }) {
  return (
    <article aria-label="How this post will look on X" className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 rounded-[14px] border border-snow-line bg-ground p-3.5 text-snow">
      <Avatar who={{ handle, name, type: brand ? "brand" : "personal" }} size={40} />
      <div className="grid min-w-0 gap-2">
        <p className="flex min-w-0 items-baseline gap-1.5 text-[15px] leading-tight">
          <span className="truncate font-bold">{name}</span>
          <span className="truncate text-snow-muted">@{handle} · now</span>
        </p>
        <p className="font-post text-[15px] leading-[1.35] break-words whitespace-pre-wrap">{text || " "}</p>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="aspect-video w-full rounded-[16px] border border-snow-line object-cover" />
        ) : note ? (
          <p className="grid aspect-video place-items-center rounded-[16px] border border-dashed border-snow-line-strong px-6 text-center text-sm text-snow-muted">{note}</p>
        ) : null}
        <p className="flex justify-between pr-6 text-snow-faint" aria-hidden="true">
          {Object.values(ICON).map((d) => (
            <svg key={d} viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={d} />
            </svg>
          ))}
        </p>
      </div>
    </article>
  );
}
