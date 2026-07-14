<?php
/**
 * The template for displaying the front page (One Page Layout)
 */

get_header();
?>

<main id="primary" class="site-main">
    <?php
    // Query all pages to display them as sections on the front page
    $args = array(
        'post_type'      => 'page',
        'posts_per_page' => -1,
        'orderby'        => 'menu_order',
        'order'          => 'ASC',
    );
    
    $onepage_query = new WP_Query( $args );

    if ( $onepage_query->have_posts() ) :
        while ( $onepage_query->have_posts() ) : $onepage_query->the_post();
            ?>
            <section id="<?php echo esc_attr( $post->post_name ); ?>" <?php post_class( 'onepage-section' ); ?>>
                <div class="container">
                    <header class="entry-header">
                        <?php the_title( '<h2 class="entry-title">', '</h2>' ); ?>
                    </header>

                    <div class="entry-content">
                        <?php
                        the_content();
                        ?>
                    </div>
                </div>
            </section>
            <?php
        endwhile;
        wp_reset_postdata();
    else :
        ?>
        <div class="container">
            <p><?php esc_html_e( 'Please create some pages in the WordPress admin to display them here as sections.', 'onepage' ); ?></p>
        </div>
        <?php
    endif;
    ?>
</main>

<?php
get_footer();
