import styles from './loading.module.css';

export default function Loading() {
  return (
    <main className={styles.screen} role='status' aria-live='polite' aria-label='Loading NexusForge app'>
      <section className={styles.content}>
        <div className={styles.logoWrap}>
          <div className={styles.halo} aria-hidden='true' />
          <img
            src='/brand/nexusforge-logo.png'
            alt='NexusForge'
            width={88}
            height={88}
            className={styles.logo}
            draggable={false}
          />
        </div>

        <div className={styles.textBlock}>
          <h1 className={styles.title}>NexusForge</h1>
          <p className={styles.status}>Preparing your workspace...</p>
          <p className={styles.phaseText}>Syncing recent updates</p>

          <div className={styles.dots} aria-hidden='true'>
            <span />
            <span />
            <span />
          </div>

          <div className={styles.progress} aria-hidden='true'>
            <div className={styles.progressFill} />
          </div>

          <p className={styles.caption}>A calmer start while the interface gets ready.</p>
        </div>

        <p className='sr-only'>NexusForge is preparing your workspace. Please wait.</p>
      </section>
    </main>
  );
}
