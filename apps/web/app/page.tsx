import styles from "./page.module.css";

export default function Home(){
    return(
        <div className={styles.container}>
            <main className={styles.main}>
                <div className={styles.brand}>
                    <h1 className={styles.title}>Inkspace</h1>
                </div>
                <p className={styles.description}>
                    A new way to collaborate and communicate.
                </p>
                <p className={styles.subtitle}>
                    Coming Soon
                </p>
                <div className={styles.dots}>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </main>
        </div>
    )
}