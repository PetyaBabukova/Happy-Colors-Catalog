# QA Checklist: Product Videos

## Owner Flow
- Create product with images only.
- Create product with images plus one MP4 video and poster image.
- Create product with multiple videos up to the allowed limit.
- Verify upload is rejected for non-MP4 video.
- Verify upload is rejected when video duration exceeds the limit.
- Verify upload is rejected when poster image is missing.
- Verify edit product can add a new video.
- Verify edit product can remove an unsaved video.
- Verify edit product can remove an already saved video.
- Verify failed rollback cleanup keeps the video entry visible and shows an error.

## PDP UX
- Product without videos renders the existing image gallery correctly.
- Product with videos shows the first video inside the same media box as images.
- Video starts muted when autoplay is allowed.
- With reduced motion enabled, video does not autoplay and controls are visible.
- When video ends, the gallery advances to the next slide.
- Swiping or clicking away from a video pauses/resets it.
- Cart thumbnail never uses a raw video URL.

## SEO and Social
- View page source and confirm a `Product` JSON-LD block is present.
- Confirm products with video include `VideoObject` entries in JSON-LD.
- Confirm products without video still emit `Product` JSON-LD.
- Confirm JSON-LD `uploadDate` is ISO 8601 when present.
- Confirm `generateMetadata` outputs Open Graph image data for the PDP.
- Confirm products with video output Open Graph video metadata.
- Share/debug a PDP URL and verify social preview uses product image or poster, not a black frame.

## Security and Integrity
- Verify `/api/uploads/delete` rejects missing or tampered delete token.
- Verify `/api/uploads/delete` rejects deleting an asset already attached to a product.
- Verify non-owner cannot delete another owner's saved product video.
- Verify create/edit rejects video or poster URLs outside the allowed GCS paths.
- Verify create/edit rejects asset URLs already attached to another product.

## Known V1 Limitations to Watch
- Parallel tabs may still hit the documented TOCTOU edge case.
- Abandoned direct uploads may remain until GCS lifecycle cleanup runs.
