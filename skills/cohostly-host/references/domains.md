# Custom domains

Read this when the person wants their own address (for example `app.theircompany.com`) in front of a project.

## Add one

`add_domain` with the project and the `hostname` (no `https://`, path or port). It returns the DNS records the person must add at their DNS host: a TXT record that proves they own the domain, and a CNAME that sends traffic here.

- **You cannot add DNS records for them.** Give the records exactly as returned, in plain words, and say where they go (their DNS host or registrar).
- The domain goes live by itself, with HTTPS, once the records are seen: usually minutes, sometimes an hour.
- A private project stays private on its custom domain: the same visibility and sign-in rules apply.

## Check one

`list_domains` shows each domain with its status (waiting for DNS records, certificate being issued, live over HTTPS, or failed), the records still to add and any problem in plain words. Report the status as shown; "waiting" is normal for a while.

## Remove one

`remove_domain` detaches it at once: it stops reaching the project, its certificate is deleted and the name is released, so someone else could claim it. The project's default address is not affected. Say which domain you are removing and get the person's agreement first.

Adding and removing need editor access on the project.
