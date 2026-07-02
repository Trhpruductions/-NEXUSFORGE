import Image from 'next/image';
import styles from './loading.module.css';

export default function Loading() {
  return (
    <main className={styles.screen} role='status' aria-live='polite' aria-label='Loading NexusForge app'>
      <section className={styles.content}>
        <div className={styles.logoWrap}>
          <div className={styles.halo} aria-hidden='true' />
          <Image
            src='/brand/nexusforge-logo.png'
            alt='NexusForge'
            width={88}
            height={88}
            className={styles.logo}
            priority
            draggable={false}
            style={{ width: 88, height: 88 }}
          />
        </div>

        <div className={styles.textBlock}>
          <h1 className={styles.title}>NexusForge</h1>
          <p className={styles.status}>Opening app...</p>

          <div className={styles.dots} aria-hidden='true'>
            <span />
            <span />
            <span />
          </div>

          <div className={styles.progress} aria-hidden='true'>
            <div className={styles.progressFill} />
          </div>

          <p className={styles.caption}>Please wait while your workspace loads.</p>
        </div>

        <p className='sr-only'>NexusForge is preparing your command network. Please wait.</p>
      </section>
    </main>
  );
}
