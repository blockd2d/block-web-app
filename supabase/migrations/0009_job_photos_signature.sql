-- Allow signature capture to be stored alongside job photos

alter table job_photos
  drop constraint if exists job_photos_kind_check;

alter table job_photos
  add constraint job_photos_kind_check check (kind in ('before', 'after', 'signature'));
